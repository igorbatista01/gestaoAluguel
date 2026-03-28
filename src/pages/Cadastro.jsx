import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { maskDate, maskCPF, maskRG, rawCPF, rawRG } from "../lib/masks";
import { isValidDate, ESTADO_CIVIL_OPCOES } from "../lib/validation";

// ── Componente ───────────────────────────────────────────────────────────────
const STEPS = ["Código", "Acesso", "Dados pessoais"];

export default function Cadastro() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [form, setForm] = useState({
    nomeCompleto: "",
    maritalStatus: "solteiro",
    rg: "",
    cpf: "",
    dataNascimento: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate(n) {
    if (n === 1 && !codigo.trim()) return "Informe o código de convite.";
    if (n === 2) {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "E-mail inválido.";
      if (password.length < 6) return "Senha deve ter pelo menos 6 caracteres.";
      if (password !== password2) return "As senhas não coincidem.";
    }
    if (n === 3) {
      if (!form.nomeCompleto.trim()) return "Nome completo obrigatório.";
      if (rawRG(form.rg).length < 4) return "RG inválido (mínimo 4 caracteres).";
      if (rawCPF(form.cpf).length !== 11) return "CPF inválido (11 dígitos).";
      if (!isValidDate(form.dataNascimento)) return "Data de nascimento inválida (DD/MM/AAAA).";
    }
    return null;
  }

  function next() {
    const err = validate(step);
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    const err = validate(3);
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);
    try {
      await register(email, password, codigo, {
        nomeCompleto: form.nomeCompleto.trim(),
        maritalStatus: form.maritalStatus,
        rg: rawRG(form.rg),
        cpf: rawCPF(form.cpf),
        dataNascimento: form.dataNascimento,
      });
      navigate("/");
    } catch (e) {
      const msgs = {
        "auth/email-already-in-use": "E-mail já está cadastrado.",
        "auth/weak-password": "Senha muito fraca.",
        "auth/invalid-email": "E-mail inválido.",
        "auth/network-request-failed": "Sem conexão. Verifique a internet.",
      };
      setError(msgs[e.code] || e.message || "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.outer}>
      <div style={s.card}>
        <div style={s.logo}>ContratFácil</div>
        <h2 style={s.title}>Criar conta</h2>

        {/* Barra de etapas */}
        <div style={s.stepBar}>
          {STEPS.map((label, i) => {
            const st = i + 1 < step ? "done" : i + 1 === step ? "active" : "idle";
            return (
              <div key={i} style={{ ...s.stepItem, ...(st === "active" ? s.stepActive : st === "done" ? s.stepDone : {}) }}>
                <span style={s.stepDot}>{st === "done" ? "✓" : i + 1}</span>
                {label}
              </div>
            );
          })}
        </div>

        {error && <div style={s.errBox}>{error}</div>}

        {/* ── Etapa 1: Código ── */}
        {step === 1 && (
          <div>
            <p style={s.hint}>
              O cadastro é por convite. Informe o código que você recebeu.
            </p>
            <label style={s.label}>Código de convite</label>
            <input
              style={s.input}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s/g, ""))}
              placeholder="Ex: K7R2PX94"
              maxLength={16}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && next()}
            />
            <button style={s.btn} onClick={next}>Continuar →</button>
          </div>
        )}

        {/* ── Etapa 2: E-mail e senha ── */}
        {step === 2 && (
          <div>
            <label style={s.label}>E-mail</label>
            <input
              style={s.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoFocus
            />
            <label style={s.label}>Senha</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
            <label style={s.label}>Confirmar senha</label>
            <input
              style={s.input}
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Repita a senha"
              onKeyDown={(e) => e.key === "Enter" && next()}
            />
            <div style={s.row}>
              <button style={s.btnSec} onClick={() => { setError(""); setStep(1); }}>← Voltar</button>
              <button style={s.btn} onClick={next}>Continuar →</button>
            </div>
          </div>
        )}

        {/* ── Etapa 3: Dados pessoais ── */}
        {step === 3 && (
          <div>
            <label style={s.label}>Nome completo</label>
            <input
              style={s.input}
              value={form.nomeCompleto}
              onChange={(e) => set("nomeCompleto", e.target.value)}
              placeholder="Seu nome completo"
              autoFocus
            />

            <div style={s.grid2}>
              <div>
                <label style={s.label}>RG</label>
                <input
                  style={s.input}
                  value={form.rg}
                  onChange={(e) => set("rg", maskRG(e.target.value))}
                  placeholder="000000000"
                  inputMode="text"
                />
              </div>
              <div>
                <label style={s.label}>CPF</label>
                <input
                  style={s.input}
                  value={form.cpf}
                  onChange={(e) => set("cpf", maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                />
              </div>
            </div>

            <div style={s.grid2}>
              <div>
                <label style={s.label}>Data de nascimento</label>
                <input
                  style={s.input}
                  value={form.dataNascimento}
                  onChange={(e) => set("dataNascimento", maskDate(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
              <div>
                <label style={s.label}>Estado civil</label>
                <select
                  style={s.input}
                  value={form.maritalStatus}
                  onChange={(e) => set("maritalStatus", e.target.value)}
                >
                  {ESTADO_CIVIL_OPCOES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={s.row}>
              <button style={s.btnSec} onClick={() => { setError(""); setStep(2); }}>← Voltar</button>
              <button
                style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Criando conta..." : "✓ Concluir cadastro"}
              </button>
            </div>
          </div>
        )}

        <p style={s.footer}>
          Já tem conta? <Link to="/login" style={{ color: "#2563eb" }}>Entrar</Link>
        </p>
      </div>
    </div>
  );
}

const s = {
  outer: { minHeight: "100vh", background: "#f4f5f7", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" },
  card: { background: "#fff", borderRadius: "18px", padding: "2rem", width: "100%", maxWidth: "460px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  logo: { fontWeight: 800, fontSize: "22px", textAlign: "center", marginBottom: "0.5rem" },
  title: { fontSize: "18px", fontWeight: 700, textAlign: "center", marginBottom: "1.5rem", color: "#111827" },
  stepBar: { display: "flex", justifyContent: "center", gap: "4px", marginBottom: "1.5rem" },
  stepItem: { display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", padding: "5px 10px", borderRadius: "20px", color: "#9ca3af", fontWeight: 500 },
  stepActive: { background: "#eff6ff", color: "#2563eb", fontWeight: 700 },
  stepDone: { color: "#16a34a" },
  stepDot: { width: "18px", height: "18px", borderRadius: "50%", background: "currentColor", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 },
  hint: { fontSize: "13px", color: "#6b7280", marginBottom: "1rem", lineHeight: 1.5 },
  label: { display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "4px" },
  input: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", marginBottom: "1rem", boxSizing: "border-box" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  row: { display: "flex", gap: "8px", justifyContent: "space-between", marginTop: "0.5rem" },
  btn: { flex: 1, background: "#2563eb", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: "pointer" },
  btnSec: { background: "#f9fafb", color: "#374151", border: "1px solid #e5e7eb", padding: "12px 20px", borderRadius: "8px", fontWeight: 500, fontSize: "14px", cursor: "pointer" },
  errBox: { background: "#fee2e2", color: "#991b1b", borderRadius: "8px", padding: "10px 14px", marginBottom: "1rem", fontSize: "13px" },
  footer: { textAlign: "center", fontSize: "13px", color: "#6b7280", marginTop: "1.5rem" },
};
