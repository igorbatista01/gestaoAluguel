import { useState, useEffect } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";

// ── Máscaras ────────────────────────────────────────────────────────────────
const soDigitos = (v, max) => v.replace(/\D/g, "").substring(0, max);

function maskDate(v) {
  const d = soDigitos(v, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function maskCPF(v) {
  const d = soDigitos(v, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
const maskRG = (v) => v.replace(/[^\dXx]/g, "").toUpperCase().substring(0, 15);
const rawCPF = (v) => v.replace(/\D/g, "");
const rawRG  = (v) => v.replace(/[^\dXx]/g, "").toUpperCase();

function displayCPF(raw) {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isValidDate(date) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return false;
  const [d, m, y] = date.split("/").map(Number);
  if (y < 1900 || y > 2099 || m < 1 || m > 12) return false;
  const ml = [31, (y % 400 === 0 || (y % 100 !== 0 && y % 4 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d > 0 && d <= ml[m - 1];
}

export default function Perfil() {
  const { user, perfil, setPerfil } = useAuth();

  // CPF e RG são bloqueados se já existirem no Firestore
  const cpfBloqueado = !!(perfil?.cpf);
  const rgBloqueado  = !!(perfil?.rg);

  const [form, setForm] = useState({
    nomeCompleto:   "",
    dataNascimento: "",
    maritalStatus:  "solteiro",
    telefone:       "",
    rg:             "",
    cpf:            "",
  });

  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  // Preenche o formulário quando o perfil carrega
  useEffect(() => {
    if (perfil) {
      setForm({
        nomeCompleto:   perfil.nomeCompleto   || "",
        dataNascimento: perfil.dataNascimento || "",
        maritalStatus:  perfil.maritalStatus  || "solteiro",
        telefone:       perfil.telefone       || "",
        rg:             perfil.rg             || "",
        cpf:            displayCPF(perfil.cpf || ""),
      });
    }
  }, [perfil]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function validate() {
    if (!form.nomeCompleto.trim()) return "Nome completo é obrigatório.";
    if (form.dataNascimento && !isValidDate(form.dataNascimento))
      return "Data de nascimento inválida (DD/MM/AAAA).";
    if (!rgBloqueado && form.rg && rawRG(form.rg).length < 4)
      return "RG inválido (mínimo 4 caracteres).";
    if (!cpfBloqueado && form.cpf && rawCPF(form.cpf).length !== 11)
      return "CPF inválido (11 dígitos).";
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setSaving(true);
    try {
      const updates = {
        nomeCompleto:   form.nomeCompleto.trim(),
        dataNascimento: form.dataNascimento,
        maritalStatus:  form.maritalStatus,
        telefone:       form.telefone.trim(),
        atualizadoEm:   serverTimestamp(),
      };

      // Só inclui RG/CPF se não estiverem bloqueados e tiverem valor
      if (!rgBloqueado  && form.rg)  updates.rg  = rawRG(form.rg);
      if (!cpfBloqueado && form.cpf) updates.cpf = rawCPF(form.cpf);

      await setDoc(doc(db, "usuarios", user.uid), updates, { merge: true });

      // Atualiza o contexto de auth para refletir os novos dados sem reload
      setPerfil((prev) => ({ ...prev, ...updates }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (perfil === undefined) {
    return (
      <div style={s.center}>
        <span style={{ color: "#9ca3af" }}>Carregando...</span>
      </div>
    );
  }

  return (
    <div style={s.outer}>
      <div style={s.card}>
        <h2 style={s.title}>Meu perfil</h2>

        <div style={s.infoBox}>
          ℹ️ Após atualizar seus dados, lembre-se de regenerar os contratos existentes para que reflitam as informações mais recentes.
        </div>

        {error   && <div style={s.errBox}>{error}</div>}
        {success && <div style={s.okBox}>Perfil salvo! Lembre-se de atualizar seus contratos para refletir as mudanças.</div>}

        {/* E-mail (somente leitura — vem do Firebase Auth) */}
        <label style={s.label}>E-mail</label>
        <input style={{ ...s.input, ...s.readOnly }} value={user?.email || ""} readOnly />

        {/* Nome completo */}
        <label style={s.label}>Nome completo</label>
        <input
          style={s.input}
          value={form.nomeCompleto}
          onChange={(e) => set("nomeCompleto", e.target.value)}
          placeholder="Seu nome completo"
        />

        {/* Data de nascimento + Estado civil */}
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
              <option value="solteiro">Solteiro(a)</option>
              <option value="casado">Casado(a)</option>
              <option value="divorciado">Divorciado(a)</option>
              <option value="viuvo">Viúvo(a)</option>
              <option value="uniao_estavel">União estável</option>
            </select>
          </div>
        </div>

        {/* Telefone */}
        <label style={s.label}>Telefone</label>
        <input
          style={s.input}
          value={form.telefone}
          onChange={(e) => set("telefone", e.target.value)}
          placeholder="(00) 00000-0000"
          inputMode="tel"
        />

        {/* RG + CPF */}
        <div style={s.grid2}>
          <div>
            <label style={s.label}>
              RG
              {rgBloqueado && <span style={s.lockTag}>bloqueado</span>}
            </label>
            {rgBloqueado ? (
              <input style={{ ...s.input, ...s.readOnly }} value={form.rg} readOnly />
            ) : (
              <input
                style={s.input}
                value={form.rg}
                onChange={(e) => set("rg", maskRG(e.target.value))}
                placeholder="000000000"
                inputMode="text"
              />
            )}
          </div>
          <div>
            <label style={s.label}>
              CPF
              {cpfBloqueado && <span style={s.lockTag}>bloqueado</span>}
            </label>
            {cpfBloqueado ? (
              <input style={{ ...s.input, ...s.readOnly }} value={form.cpf} readOnly />
            ) : (
              <input
                style={s.input}
                value={form.cpf}
                onChange={(e) => set("cpf", maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={14}
              />
            )}
          </div>
        </div>

        {(rgBloqueado || cpfBloqueado) && (
          <p style={s.lockNote}>
            🔒 RG e CPF não podem ser alterados após o cadastro. Se precisar corrigir, entre em contato com o administrador.
          </p>
        )}

        <button
          style={{ ...s.btn, opacity: saving ? 0.7 : 1 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}

const s = {
  outer:   { padding: "2rem 1.5rem", display: "flex", justifyContent: "center" },
  center:  { minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" },
  card:    { background: "#fff", borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "500px", boxShadow: "0 2px 16px rgba(0,0,0,0.07)" },
  title:   { fontSize: "20px", fontWeight: 700, color: "#111827", marginBottom: "1.5rem" },
  label:   { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "4px" },
  input:   { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", marginBottom: "1rem", boxSizing: "border-box", background: "#fff", color: "#111827" },
  readOnly:{ background: "#f9fafb", color: "#6b7280", cursor: "not-allowed" },
  grid2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  btn:     { width: "100%", background: "#2563eb", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: "pointer", marginTop: "0.5rem" },
  errBox:  { background: "#fee2e2", color: "#991b1b", borderRadius: "8px", padding: "10px 14px", marginBottom: "1rem", fontSize: "13px" },
  okBox:   { background: "#dcfce7", color: "#166534", borderRadius: "8px", padding: "10px 14px", marginBottom: "1rem", fontSize: "13px", fontWeight: 600 },
  lockTag: { background: "#fef3c7", color: "#92400e", fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "20px" },
  lockNote:{ fontSize: "12px", color: "#6b7280", marginBottom: "1rem", lineHeight: 1.5 },
  infoBox: { background: "#eff6ff", color: "#1e40af", borderRadius: "8px", padding: "10px 14px", marginBottom: "1.25rem", fontSize: "13px", lineHeight: 1.5 },
};
